/** Peta ticker kripto ke id CoinGecko.
 *
 *  CoinGecko memakai id ("bitcoin"), bukan simbol ("BTC"), dan simbol tidak
 *  unik: ada belasan koin bersimbol "SOL". Peta tetap ini menjamin ticker
 *  populer selalu menunjuk koin yang benar. Ticker di luar daftar dicari lewat
 *  endpoint pencarian CoinGecko, dan hasilnya diambil yang peringkat pasarnya
 *  paling tinggi. */
export const ID_KRIPTO: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", USDT: "tether", BNB: "binancecoin",
  SOL: "solana", USDC: "usd-coin", XRP: "ripple", ADA: "cardano",
  DOGE: "dogecoin", TRX: "tron", TON: "the-open-network", AVAX: "avalanche-2",
  SHIB: "shiba-inu", DOT: "polkadot", LINK: "chainlink", MATIC: "matic-network",
  POL: "polygon-ecosystem-token", BCH: "bitcoin-cash", LTC: "litecoin",
  NEAR: "near", UNI: "uniswap", ICP: "internet-computer", APT: "aptos",
  ETC: "ethereum-classic", XLM: "stellar", ATOM: "cosmos", FIL: "filecoin",
  ARB: "arbitrum", OP: "optimism", IMX: "immutable-x", INJ: "injective-protocol",
  SUI: "sui", SEI: "sei-network", RENDER: "render-token", HBAR: "hedera-hashgraph",
  VET: "vechain", GRT: "the-graph", AAVE: "aave", MKR: "maker",
  ALGO: "algorand", SAND: "the-sandbox", MANA: "decentraland", AXS: "axie-infinity",
  FTM: "fantom", THETA: "theta-token", EGLD: "elrond-erd-2", FLOW: "flow",
  XMR: "monero", CAKE: "pancakeswap-token", CRV: "curve-dao-token",
  PEPE: "pepe", WIF: "dogwifcoin", BONK: "bonk", TIA: "celestia",
  STX: "blockstack", KAS: "kaspa", RUNE: "thorchain", LDO: "lido-dao",
};
