# Deploying the scribe parity build

This branch holds the built Twake Drive app of `feat/onlyoffice-scribe-parity`
(source commit `f682f6dc3`) at its root, and the built OnlyOffice scribe
plugin in `onlyoffice-scribe-plugin/`. Nothing here is meant to be edited: the
branch is rebuilt from the source branch after each change.

## 1. Drive

Install or update the app on the instance from this branch:

```sh
cozy-stack apps install drive git://github.com/linagora/twake-drive.git#build-scribe-parity --domain <instance>
# or, when drive is already installed
cozy-stack apps update drive git://github.com/linagora/twake-drive.git#build-scribe-parity --domain <instance>
```

Flags on the instance:

```sh
cozy-stack features flags --domain <instance> '{"cozy.assistant.enabled": true}'
# optional: cut the whole document the assistant may ask for, in characters
cozy-stack features flags --domain <instance> '{"drive.scribe.contextBudget": 60000}'
```

## 2. OnlyOffice Document Server

Copy the plugin to the Document Server and flush its cache (or restart it):

```sh
scp -r onlyoffice-scribe-plugin/ <document-server>:/var/www/onlyoffice/documentserver/sdkjs-plugins/twake-scribe
ssh <document-server> documentserver-flush-cache.sh
```

The plugin must be declared to the editor the way Drive expects (see
`docs/onlyoffice-scribe.md` of the source branch, section "Requirements"): a
stock Document Server 9.x, no patched sdkjs.

## 3. Twake Assistant

The scribe needs the assistant build of the matching branch
(`linagora/twake-assistant`, branch `build-scribe-parity`, built from
`8bc77e2`):

```sh
cozy-stack apps install assistant git://github.com/linagora/twake-assistant.git#build-scribe-parity --domain <instance>
# or
cozy-stack apps update assistant git://github.com/linagora/twake-assistant.git#build-scribe-parity --domain <instance>
```

## 4. Check

Open a text document in Drive: the AI button of the toolbar, the floating
button at the top right of the page, the button under a selected text, and the
"Assistant" tab of the editor all open the scribe. Replace a selected text with
an answer: footnotes, references, images and underlines are kept.
