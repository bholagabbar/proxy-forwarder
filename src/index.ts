import { getProxyPortByETMinute } from './getProxyPortByETMinute';
import { Server } from 'proxy-chain';

const log = (...args: unknown[]) => console.log('[proxy-forwarder]', ...args);

log(`Service starting - ${new Date().toISOString()}`);

function parseProxyList(): string[] {
	const raw = process.env.PROXY_LIST;
	if (!raw || raw === '') return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((u): u is string => typeof u === 'string' && u.startsWith('http'));
	} catch {
		return [];
	}
}

const PROXY_LIST = parseProxyList();

const PORT = Number(process.env.PORT) || 8000;

const PROXY_PORT_LOWER = Number(process.env.PROXY_PORT_LOWER);
const PROXY_PORT_UPPER = Number(process.env.PROXY_PORT_UPPER);
let PROXY_PORT: number;
const envProxyPort = Number(process.env.PROXY_PORT);
if (!isNaN(envProxyPort) && envProxyPort > 0) {
	PROXY_PORT = envProxyPort;
} else if (!isNaN(PROXY_PORT_LOWER) && !isNaN(PROXY_PORT_UPPER)) {
	if (PROXY_PORT_LOWER > PROXY_PORT_UPPER) {
		throw new Error(`PROXY_PORT_LOWER (${PROXY_PORT_LOWER}) must be <= PROXY_PORT_UPPER (${PROXY_PORT_UPPER})`);
	}
	PROXY_PORT = Math.floor(Math.random() * (PROXY_PORT_UPPER - PROXY_PORT_LOWER + 1)) + PROXY_PORT_LOWER;
} else {
	PROXY_PORT = 8000;
}

const USE_PROXY_LIST = process.env.USE_PROXY_LIST === 'true';
let UPSTREAM_PROXY_HOST: string;
let UPSTREAM_PROXY_URL: string;
let PROXY_NUM = 0;

if (USE_PROXY_LIST) {
	if (PROXY_LIST.length === 0) {
		throw new Error('USE_PROXY_LIST is true but PROXY_LIST env is missing or invalid (expect JSON array of http URLs).');
	}
	const envProxyNum = process.env.PROXY_NUM;
	if (!envProxyNum || envProxyNum === '') {
		PROXY_NUM = Math.floor(Math.random() * PROXY_LIST.length);
		log(`PROXY_NUM not set, randomly selected proxy #${PROXY_NUM} from list of ${PROXY_LIST.length}`);
	} else {
		PROXY_NUM = Number(envProxyNum);
	}
	if (PROXY_NUM >= PROXY_LIST.length) {
		throw new Error(`PROXY_NUM (${PROXY_NUM}) is out of bounds. Proxy list has ${PROXY_LIST.length} entries.`);
	}
	UPSTREAM_PROXY_URL = PROXY_LIST[PROXY_NUM];
	UPSTREAM_PROXY_HOST = UPSTREAM_PROXY_URL;
	log(`Using proxy list mode: proxy #${PROXY_NUM} from list`);
} else {
	UPSTREAM_PROXY_HOST = process.env.UPSTREAM_PROXY_HOST || '';
	if (!UPSTREAM_PROXY_HOST) {
		throw new Error('UPSTREAM_PROXY_HOST is required when USE_PROXY_LIST is not true.');
	}
	UPSTREAM_PROXY_URL = `${UPSTREAM_PROXY_HOST}:${PROXY_PORT}`;
}

const proxyServer = new Server({
	port: PORT,
	verbose: process.env.VERBOSE === 'true',
	prepareRequestFunction: ({ request }) => {
		if (USE_PROXY_LIST) {
			log(`Request: ${request.url} via proxy list #${PROXY_NUM}`);
			return { upstreamProxyUrl: UPSTREAM_PROXY_URL };
		}

		let port: number;
		if (!isNaN(envProxyPort) && envProxyPort > 0) {
			port = PROXY_PORT;
			log(`Using static port ${port}`);
		} else {
			port = getProxyPortByETMinute();
			log(`Using dynamic ET-minute port ${port}`);
		}

		const upstreamProxyUrl = `${UPSTREAM_PROXY_HOST}:${port}`;
		log(`Request: ${request.url} via port ${port}`);
		return { upstreamProxyUrl };
	},
});

proxyServer.listen(() => {
	log(`Proxy server listening on port ${PORT}`);
	if (USE_PROXY_LIST) {
		log(`Upstream proxy: list #${PROXY_NUM}`);
	} else {
		if (!isNaN(envProxyPort) && envProxyPort > 0) {
			log(`Upstream proxy: ${UPSTREAM_PROXY_HOST} (static port ${envProxyPort})`);
		} else {
			log(`Upstream proxy: ${UPSTREAM_PROXY_HOST} (ET-minute ports ${PROXY_PORT_LOWER}-${PROXY_PORT_UPPER})`);
		}
	}
});

process.on('SIGTERM', async () => {
	log('SIGTERM received, shutting down gracefully');
	await proxyServer.close(true);
	process.exit(0);
});
