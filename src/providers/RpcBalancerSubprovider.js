const SubProvider = require("web3-provider-engine/subproviders/subprovider.js");
const RpcSubprovider = require("web3-provider-engine/subproviders/rpc.js");

module.exports = class RpcFetchBalancerSubprovider extends SubProvider {

    constructor (options) {
        super();
        this.rpcApiUrls = [
            "https://mainnet.infura.io"
        ];
        this.rpcApis = [];
        this.currentRpcApi = 0;
        this.options = Object.assign({
            // rpcApis: [],
            // onRpcProviderChange({ fromUrl, toUrl, err, response }),
            rpcRetries: 3,
            rpcRetryTimeout: 25 // ms
        }, options);
        if (this.options.rpcApis && this.options.rpcApis.length) {
            this.rpcApiUrls = this.options.rpcApis.slice();
            this.rpcApis = [];
        }
        for (const api of this.rpcApiUrls) {
            this.addRpcApi(api);
        }
    }

    addRpcApi (url) {
        this.rpcApis.push(new RpcSubprovider({ rpcUrl: url }));
    }

    getCurrentRpcApi () {
        return this.rpcApis[this.currentRpcApi];
    }

    switchToNextRpcApi (previousRpcApi = 0, err, res) {
        if (this.currentRpcApi !== previousRpcApi) {
            return false;
        }
        const from = this.rpcApiUrls[this.currentRpcApi];
        this.currentRpcApi = (this.currentRpcApi + 1) % this.rpcApis.length;
        if (typeof this.options.onRpcProviderChange === "function") {
            this.options.onRpcProviderChange({
                from: from,
                to: this.rpcApiUrls[this.currentRpcApi],
                error: err,
                response: res || null
            });
        }
        return true;
    }

    handleRequest (payload, next, end) {
        let attempts = 1;
        let previousRpcApi;
        // In order not to mess up with callbacks, RPC API switch is performed only if the previousRpcApi === current
        const handle = (err, res) => {
            if (err) {
                const success = this.switchToNextRpcApi(previousRpcApi, err, res);
                attempts++;
                if (success && attempts > (this.options.rpcRetries || 3) * this.rpcApis.length) {
                    return end(err, res);
                }
                return setTimeout(request, this.options.rpcRetryTimeout || 25);
            }
            end(err, res);
        }
        const request = () => {
            previousRpcApi = this.currentRpcApi;
            return this.getCurrentRpcApi().handleRequest(payload, next, handle);
        };
        request();
    }

};