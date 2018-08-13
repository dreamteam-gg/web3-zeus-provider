const ProviderEngine = require("web3-provider-engine");
const HookedWalletEthTxSubprovider = require("web3-provider-engine/subproviders/hooked-wallet-ethtx");
const FiltersSubprovider = require("web3-provider-engine/subproviders/filters.js");
const NonceSubprovider = require("web3-provider-engine/subproviders/nonce-tracker.js");
const { privateToAddress } = require("ethereumjs-util");
const RpcBalancerSubprovider = require("./providers/RpcBalancerSubProvider.js");
const CacheSubprovider = require("web3-provider-engine/subproviders/cache.js");
// const ProviderSubprovider = require("web3-provider-engine/subproviders/provider.js");
// const Web3 = require("web3");

const pkToAddress = (privateKey) => "0x" + privateToAddress("0x" + privateKey).toString("hex");

function ZeusProvider (options = {}) {

    this.options = Object.assign({
        // onRpcProviderChange: ({ from, to, error, response }) => { ... },
        rpcApis: ["https://mainnet.infura.io"],
        privateKeys: []
    }, options);

    /**
     * @type {Map<string, Buffer>}
     */
    this.accounts = this.options.privateKeys.reduce((map, privateKey) => {
        map.set(pkToAddress(privateKey), Buffer.from(privateKey, "hex"));
        return map;
    }, new Map());

    this.engine = new ProviderEngine();
    this.engine.addProvider(new CacheSubprovider());
    this.engine.addProvider(new FiltersSubprovider());
    this.engine.addProvider(new NonceSubprovider());
    this.engine.addProvider(new HookedWalletEthTxSubprovider({
        getAccounts: (cb) => {
            cb(null, Array.from(this.accounts.keys()));
        },
        getPrivateKey: (address, cb) => {
            if (!this.accounts.has(address)) {
                return cb(`[Web3ZeusProvider] Unable to send transaction: no private key specified for address ${ address }`);
            }
            return cb(null, this.accounts.get(address));
        }
    }));
    this.engine.addProvider(new RpcBalancerSubprovider(this.options));

    this.engine.on("error", function (err) {
        console.error("[Web3ZeusProvider] Engine error", err)
    });

    this.engine.start();

}

ZeusProvider.prototype.importAccount = function (pk) {
    this.accounts.set(pkToAddress(pk), pk);
};

ZeusProvider.prototype.revokeAccount = function (addressOrPk) {
    const isPk = /[a-fA-F0-9]{64}/.test(addressOrPk);
    this.accounts.delete(isPk ? pkToAddress(addressOrPk) : addressOrPk);
};

ZeusProvider.prototype.send = function () {
    console.warn(`[Web3ZeusProvider] Warning! Synchronous send is triggered. Avoid using synchronous requests!`);
    return this.engine.send.apply(this.engine, arguments);
};

ZeusProvider.prototype.sendAsync = function () {
    this.engine.sendAsync.apply(this.engine, arguments);
};

ZeusProvider.prototype.terminate = function () {
    this.engine.stop();
};

module.exports = ZeusProvider;