# Google Sheets and YouTube Setup

This is the longest part of the setup. Budget an hour. It is all one-time.

## 1. Create a Google Cloud project

console.cloud.google.com, new project, name it something you will recognize.

## 2. Enable two APIs

APIs and Services, Library. Enable:

- Google Sheets API
- Google Drive API for the n8n Sheets credential
- YouTube Data API v3

## 3. Configure the OAuth consent screen

External. Fill in the app name, your email, and a support email.

Under Scopes, add:

```
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube
```

Under Test users, add your own Google account. Without this, OAuth fails with an access blocked error.

You do not need to publish the app or go through verification. Test mode works for personal use.

## 4. Create OAuth credentials

Credentials, Create Credentials, OAuth client ID, Web application.

Under Authorized redirect URIs, paste the callback URL that n8n shows you when you create a Google credential. n8n Cloud and self-hosted have different callback URLs, so copy it from your own instance.

Copy the client ID and client secret into n8n.

## 5. Quota warning

YouTube allocates a separate daily uploads quota. Verify your project’s actual quota in Google Cloud. [YouTube quota calculator](https://developers.google.com/youtube/data/determine_quota_cost)

Sheets API quota is generous and you will not hit it.

## 6. Create the tracking sheet

Make a new Google Sheet. Use the column schema in `../templates/tracking-sheet.md`.

Copy the spreadsheet ID from the URL. It is the long string between `/d/` and `/edit`.

Put it in Workflow 3 and Workflow 4. Both need it.

## 7. Test the upload separately

Verify Google authorization and the intended channel first. Keep allowYoutubeUpload disabled for the dry run. A real upload is private and requires operator approval.
