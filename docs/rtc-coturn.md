# WebRTC ICE configuration and coturn setup

`src/lib/rtc.ts` reads ICE servers from Vite build-time environment variables.
No public demo TURN credentials are committed. Configure production deployments
with your own STUN/TURN service before building the web app.

## Environment variables

Preferred single-variable form:

```bash
VITE_RTC_ICE_SERVERS='[{"urls":["stun:turn.example.com:3478"]},{"urls":["turn:turn.example.com:3478?transport=udp","turns:turn.example.com:5349?transport=tcp"],"username":"APP_TURN_USER","credential":"APP_TURN_PASSWORD"}]'
```

Split-variable form:

```bash
VITE_RTC_STUN_URLS=stun:turn.example.com:3478
VITE_RTC_TURN_URLS=turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp
VITE_RTC_TURN_USERNAME=APP_TURN_USER
VITE_RTC_TURN_CREDENTIAL=APP_TURN_PASSWORD
```

`VITE_RTC_ICE_SERVERS` wins when set. Values are embedded into the browser
bundle by Vite, so use app-specific TURN credentials or time-limited credentials
instead of a privileged coturn admin secret.

## Minimal coturn deployment

Install coturn on a host with a public IP and DNS name such as
`turn.example.com`. Open these firewall ports:

- `3478/udp` and `3478/tcp` for STUN/TURN
- `5349/tcp` for TLS TURN (`turns:`)
- a UDP relay range, for example `49152-65535/udp`

Example `/etc/turnserver.conf`:

```conf
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
realm=turn.example.com
server-name=turn.example.com
user=APP_TURN_USER:APP_TURN_PASSWORD
cert=/etc/letsencrypt/live/turn.example.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.example.com/privkey.pem
min-port=49152
max-port=65535
no-multicast-peers
no-cli
```

Restart coturn after editing:

```bash
sudo systemctl enable --now coturn
sudo systemctl restart coturn
```

## Build with configured ICE servers

```bash
VITE_RTC_STUN_URLS=stun:turn.example.com:3478 \
VITE_RTC_TURN_URLS=turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp \
VITE_RTC_TURN_USERNAME=APP_TURN_USER \
VITE_RTC_TURN_CREDENTIAL=APP_TURN_PASSWORD \
npm run build
```

## Validation

Use the deployed app from two networks (for example Wi-Fi plus cellular) and
confirm audio/video connects. If direct peer-to-peer ICE fails, the selected
candidate pair should show `relay` in browser WebRTC internals.
