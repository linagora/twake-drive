# Lookup Intent

The Lookup intent tells an app which files of Drive it stored from its own items, through the references the [Upload intent](upload-intent.md#reference) adds to them. Twake Mail uses it to show "See in Drive" on an attachment already saved, without any permission on the files of the user.

It has no interface: open it in a hidden frame. It uses the usual Cozy intent lifecycle (`ready`, then `done` or `error`). This page describes only the Lookup-specific contract.

## Request

```ts
action = "LOOKUP";
type = "io.cozy.files";
```

Pass the references as the intent data, all the items of a view in one intent:

```json
{
  "references": [
    { "type": "io.cozy.mails.attachments", "id": "a1:e1:b1" },
    { "type": "io.cozy.mails.attachments", "id": "a1:e1:b2" }
  ]
}
```

- `references`: 1 to 100 references, with the rules of the Upload intent: `type` is `io.cozy.mails.attachments`, `id` is `<accountId>:<emailId>:<blobId>` (three nonempty parts without `:` or `/`, 256 characters at most). A repeated reference is looked up once.
- A list that breaks these rules fails the whole intent with an `error`, before any lookup.

## Result

The `done` result has one entry per id asked:

```json
{
  "files": {
    "a1:e1:b1": {
      "fileId": "file-id",
      "name": "report.pdf",
      "dirId": "folder-id",
      "trashed": false
    },
    "a1:e1:b2": null
  }
}
```

- `null`: no file references the item.
- A file: the first one out of the trash, or else the first one in the trash (`trashed: true`). A file deleted for good no longer references the item.
- Nothing else about the file is given: no path, no size, no sharing.
- When one lookup fails, the whole intent fails with an `error`.

## Limitations

- Any app that can create an intent may ask. It learns about a file only if it knows the id of the item, and the answer goes to its own origin only.
- One intent loads Drive in a frame: create one per view, not one per item.
- Each reference costs a request to the Stack, which reads two CouchDB views for it. Drive sends 5 at a time, so a list of 100 takes 20 rounds.
- An older Drive has no `LOOKUP`: the Stack finds no service for the intent, and the caller should behave as if nothing was found.
