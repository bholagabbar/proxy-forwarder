# proxy-forwarder

HTTP proxy that forwards traffic to an authenticated upstream proxy. Use it when your client cannot send proxy credentials (e.g. Puppeteer, Playwright, or browsers that only accept `host:port`). Compatible with most popular proxy providers.

Many runtimes do not support authenticated HTTP proxies. Puppeteer accepts only `--proxy-server=host:port` and has no API for username/password ([puppeteer/puppeteer#676](https://github.com/puppeteer/puppeteer/issues/676)). Deploy this service in front of your real proxy; your app connects to the forwarder without credentials, and the forwarder adds auth to the upstream.

After deploying to your infrastructure provider, use the forwarder’s public URL as your proxy in Puppeteer (see [Example (Puppeteer)](#example-puppeteer)).

## Deployment

Runs on Node.js. Entry point is `src/index.ts`. Deploy to any infrastructure provider that lets you expose a service over a TCP port (e.g. [Railway](https://railway.app)).

The least complicated setup: set `UPSTREAM_PROXY_HOST` and `PROXY_PORT`, then deploy and run.

Once deployed, simply use the forwarder’s public URL and port as your proxy—no credentials required on the client side.

### Deploy with Docker

```bash
docker build -t proxy-forwarder .
docker run -d -p 8000:8000 \
  -e UPSTREAM_PROXY_HOST=http://user:pass@your-upstream-proxy.com \
  -e PROXY_PORT=8080 \
  proxy-forwarder
```

Set `PORT` if you want the forwarder to listen on something other than 8000. Use the same env vars as in [Environment reference](#environment-reference) for port-range or fixed-list strategies.

<img width="652" height="527" alt="image" src="https://github.com/user-attachments/assets/d187f4a7-3367-4840-aa05-899be0369936" />

## Upstream selection strategies

You run the forwarder in one of three modes. Choose the strategy that matches your provider and port layout.

| Strategy | When to use | Required env |
|----------|-------------|---------------|
| **Static port** | Single upstream proxy on one port | `UPSTREAM_PROXY_HOST`, `PROXY_PORT` |
| **Port range** | One host, multiple ports (e.g. rotating IPs by port). Port chosen at startup at random, or per request by Eastern Time minute | `UPSTREAM_PROXY_HOST`, `PROXY_PORT_LOWER`, `PROXY_PORT_UPPER` |
| **Fixed list** | Explicit list of full proxy URLs (e.g. provider gives you many `http://user:pass@host:port` endpoints) | `USE_PROXY_LIST=true`, `PROXY_LIST` (JSON array), optional `PROXY_NUM` (index, or random if unset) |

- **Static port:** Set `PROXY_PORT`. Every request uses that port on `UPSTREAM_PROXY_HOST`.
- **Port range:** Set `PROXY_PORT_LOWER` and `PROXY_PORT_UPPER`. If `PROXY_PORT` is also set, that single port is used; otherwise the server picks a port at startup at random, or per request using the current minute in Eastern Time (see `src/getProxyPortByETMinute.ts`).
- **Fixed list:** Set `USE_PROXY_LIST=true` and `PROXY_LIST` to a JSON array of full URLs. Use `PROXY_NUM` to pin an index, or leave it unset for a random selection at startup.

## Environment reference

| Variable | Description |
|----------|-------------|
| `PORT` | Listen port (default `8000`). |
| `UPSTREAM_PROXY_HOST` | Upstream URL including auth, e.g. `http://user:pass@host` (required unless using fixed list). |
| `PROXY_PORT` | Static upstream port (should've been named `UPSTREAM_PROXY_PORT`, but oh well). |
| `PROXY_PORT_LOWER`, `PROXY_PORT_UPPER` | Port range for port-range strategy. |
| `USE_PROXY_LIST` | Set to `true` for fixed-list strategy. |
| `PROXY_LIST` | JSON array of full proxy URLs. Required when `USE_PROXY_LIST=true`. |
| `PROXY_NUM` | Index into `PROXY_LIST` (optional; random if unset). |
| `VERBOSE` | Set to `true` for verbose proxy-chain logs. |

Copy `.env.example` to `.env` and configure for your chosen strategy.

## Local development

Requires [Node.js 22](https://nodejs.org/en/download/current/).

```bash
npm i
cp .env.example .env
npm run dev
```

## Example (Puppeteer)

```js
const forwarder = process.env.PROXY_FORWARDER_URL; // e.g. http://your-proxy-forwarder:8000

const browser = await puppeteer.launch({
  args: [`--proxy-server=${new URL(forwarder).host}`],
});
```

## License

MIT
