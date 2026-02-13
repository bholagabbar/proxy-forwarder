/**
 * Get proxy port based on the current Eastern Time minute
 * @returns Port number or 1 if env vars not set
 */
export function getProxyPortByETMinute(): number {
	const PROXY_PORT_LOWER = Number(process.env.PROXY_PORT_LOWER || 8001);
	const PROXY_PORT_UPPER = Number(process.env.PROXY_PORT_UPPER || 8050);

	if (isNaN(PROXY_PORT_LOWER) || isNaN(PROXY_PORT_UPPER)) {
		return PROXY_PORT_LOWER;
	}

	const now = new Date();
	const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
	const currentMinute = etTime.getMinutes();

	if (currentMinute >= 1 && currentMinute <= 50) {
		return PROXY_PORT_LOWER + (currentMinute - 1);
	}
	return PROXY_PORT_LOWER;
}
