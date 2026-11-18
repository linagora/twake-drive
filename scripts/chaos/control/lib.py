"""Helpers of the control scripts of Twake Drive that bash cannot do alone. Standard library only.

    python3 -I lib.py passhash <password> <salt> <iterations>   the passphrase as the login page hashes it (PBKDF2)
    python3 -I lib.py png <out> <seed>                          a small PNG image, its colours from the seed
    python3 -I lib.py docx <out> <text>                         a minimal Word document holding the text
    python3 -I lib.py jwt <secret> <json payload>               an HS256 JWT (OnlyOffice's inbox / outbox secret)
    python3 -I lib.py realtime <ws url> <host> <token> <doctype> <needle> <timeout> <ready file>
        connects to cozy-stack's /realtime/ websocket (io.cozy.websocket), AUTH, SUBSCRIBE, touches <ready file>, then
        waits for an event whose text has <needle>: exit 0 when received, 1 at the timeout, 2 when it cannot subscribe
"""
import base64
import hashlib
import hmac
import json
import os
import socket
import struct
import sys
import time
import urllib.parse
import zipfile
import zlib


def passhash(password, salt, iterations):
    # pkg/crypto/pbkdf2.go HashPassWithPBKDF2: key = PBKDF2(pass, salt, n); hashed = PBKDF2(key, pass, 1), base64
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations), 32)
    hashed = hashlib.pbkdf2_hmac("sha256", key, password.encode(), 1, 32)
    print(base64.b64encode(hashed).decode())


def png(out, seed):
    h = hashlib.sha256(seed.encode()).digest()
    w = hgt = 64
    rows = b""
    for y in range(hgt):
        row = b"\x00"
        for x in range(w):
            row += bytes([h[(x // 8) % 32], h[(y // 8) % 32], h[(x + y) % 32]])
        rows += row

    def chunk(kind, data):
        c = kind + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, hgt, 8, 2, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")
    with open(out, "wb") as f:
        f.write(data)


def docx(out, text):
    ct = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="xml" ContentType="application/xml"/>'
          '<Override PartName="/word/document.xml" '
          'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
            'officeDocument" Target="word/document.xml"/></Relationships>')
    doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
           '<w:p><w:r><w:t>%s</w:t></w:r></w:p></w:body></w:document>' % text)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ct)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", doc)


def b64url(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def jwt(secret, payload):
    head = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = b64url(json.dumps(json.loads(payload), separators=(",", ":")).encode())
    sig = hmac.new(secret.encode(), (head + "." + body).encode(), hashlib.sha256).digest()
    print(head + "." + body + "." + b64url(sig))


# ------------------------------------------------------------------------------------------------ the websocket
class WS:
    def __init__(self, url, host, timeout):
        u = urllib.parse.urlparse(url)
        self.sock = socket.create_connection((u.hostname, u.port or 80), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        req = ("GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
               "Origin: http://%s\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Protocol: io.cozy.websocket\r\n"
               "Sec-WebSocket-Version: 13\r\n\r\n" % (u.path or "/", host, host, key))
        self.sock.sendall(req.encode())
        resp = b""
        while b"\r\n\r\n" not in resp:
            d = self.sock.recv(4096)
            if not d:
                raise ConnectionError("closed during the handshake")
            resp += d
        head, self.buf = resp.split(b"\r\n\r\n", 1)
        status = head.split(b"\r\n")[0].decode(errors="replace")
        if " 101 " not in status + " ":
            raise ConnectionError("handshake: " + status)

    def send(self, text):
        data = text.encode()
        mask = os.urandom(4)
        n = len(data)
        if n < 126:
            hdr = struct.pack("!BB", 0x81, 0x80 | n)
        elif n < 65536:
            hdr = struct.pack("!BBH", 0x81, 0x80 | 126, n)
        else:
            hdr = struct.pack("!BBQ", 0x81, 0x80 | 127, n)
        self.sock.sendall(hdr + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def _read(self, n):
        while len(self.buf) < n:
            d = self.sock.recv(65536)
            if not d:
                raise ConnectionError("closed by the server")
            self.buf += d
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recv(self):
        """The next text message (pings answered, fragments joined)."""
        msg = b""
        while True:
            b1, b2 = self._read(2)
            op, n = b1 & 0x0F, b2 & 0x7F
            if n == 126:
                n = struct.unpack("!H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack("!Q", self._read(8))[0]
            mask = self._read(4) if b2 & 0x80 else None
            payload = self._read(n)
            if mask:
                payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
            if op == 0x8:
                raise ConnectionError("closed by the server")
            if op == 0x9:  # ping: pong
                m = os.urandom(4)
                self.sock.sendall(struct.pack("!BB", 0x8A, 0x80 | len(payload)) + m
                                  + bytes(b ^ m[i % 4] for i, b in enumerate(payload)))
                continue
            if op in (0x1, 0x2, 0x0):
                msg += payload
                if b1 & 0x80:
                    return msg.decode(errors="replace")


def realtime(url, host, token, doctype, needle, timeout, ready):
    deadline = time.time() + float(timeout)
    try:
        ws = WS(url, host, 10)
        ws.send(json.dumps({"method": "AUTH", "payload": token}))
        ws.send(json.dumps({"method": "SUBSCRIBE", "payload": {"type": doctype}}))
    except Exception as e:  # noqa: BLE001
        print("cannot subscribe: %s" % e)
        sys.exit(2)
    # the subscription is effective once the server has read it: an error comes back at once, else nothing
    ws.sock.settimeout(0.5)
    try:
        m = ws.recv()
        if '"error"' in m:
            print("subscription refused: %s" % m[:200])
            sys.exit(2)
        if needle in m:
            print("event received")
            sys.exit(0)
    except socket.timeout:
        pass
    except Exception as e:  # noqa: BLE001
        print("websocket closed after the subscription: %s" % e)
        sys.exit(1)
    open(ready, "w").close()
    while time.time() < deadline:
        ws.sock.settimeout(max(0.1, deadline - time.time()))
        try:
            m = ws.recv()
        except socket.timeout:
            break
        except Exception as e:  # noqa: BLE001
            print("websocket closed: %s" % e)
            sys.exit(1)
        if '"error"' in m and needle not in m:
            print("error event: %s" % m[:200])
            sys.exit(1)
        if needle in m:
            print("event received")
            sys.exit(0)
    print("no event after %ss" % timeout)
    sys.exit(1)


if __name__ == "__main__":
    cmd, args = sys.argv[1], sys.argv[2:]
    {"passhash": passhash, "png": png, "docx": docx, "jwt": jwt, "realtime": realtime}[cmd](*args)
