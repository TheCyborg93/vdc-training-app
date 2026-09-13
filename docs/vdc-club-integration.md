# VDC-Training → VDC-Club

VDC-Training remains the source of truth for training plans, training days,
participants and training statistics.

## Endpoint

`GET /api/integrations/vdc-club`

The response contains:

- published/running/completed training days
- training plan title, goal and exercises
- participating players
- active boards
- compact player training statistics

## Authentication

Set a random token with at least 32 characters in both projects:

- VDC-Training: `VDC_CLUB_SYNC_TOKEN`
- VDC-Club: `VDC_TRAINING_SYNC_TOKEN`

VDC-Club sends the token as a Bearer token. Never commit the secret.
