# Web3 Zeus Provider

Reliable Web3 provider which features:

+ Connects to multiple RPC APIs and switches between them when some are unavailable.
+ Allows to specify private keys for signing transactions.

Primarily made for server-side usage (as it depends on [heavy library](https://github.com/MetaMask/provider-engine)).

Installation
------------

```bash
npm install --save web3-zeus-provider
```

Usage
-----

```javascript
const ZeusProvider = require("web3-zeus-provider");
const zeusProvider = new ZeusProvider({
    rpcApis: [
        "https://mainnet.infura.io",
        "https://localhost:8545"
    ],
    privateKeys: [ // Accounts which are used for offline transaction signing
        "FCAFC28AF87287F3AB81554C2DF38C3FCE6E2C7654DB7710243A2D52A9EDF441"
    ],
    onRpcProviderChange: function ({ from, to, error, response }) {
        console.log(`RPC provider switched from ${ from } to ${ to } because of ${ error }`);
    }
});
const Web3 = require("web3");
const web3 = new Web3(zeusProvider);

// Example
web3.eth.getBlockNumber().then((blockNumber) => {
    console.log(blockNumber);
});

// ...

zeusProvider.terminate(); // Stop internal provider engine listeners once you don't need provider anymore
```

Development
-----------

Develop using local environment or Docker:

```bash
bash docker.sh
```

License
-------

[MIT](LICENSE) (c) [Nikita Savchenko](https://nikita.tk)