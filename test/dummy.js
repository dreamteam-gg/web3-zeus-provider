const assert = require("assert");
const Web3 = require("web3");
const ZeusProvider = require("..");

describe("Zeus Provider", function() {

    let web3;
    let zeusProvider;

    describe("Initialization", function() {

        it("Should instantiate ZeusProvider", () => {
            
            zeusProvider = new ZeusProvider({
                rpcApis: [
                    "https://mainnet.infura.io"
                ],
                privateKeys: [
                    "FCAFC28AF87287F3AB81554C2DF38C3FCE6E2C7654DB7710243A2D52A9EDF441"
                ]
            });

            assert.equal(typeof zeusProvider, "object");

        });

        it("Should initialize web3 with ZeusProvider", async () => {

            web3 = new Web3(zeusProvider);

            assert.equal(web3.currentProvider, zeusProvider);

            const block = await web3.eth.getBlockNumber();

            assert.equal(block > 1, true);

        });

    });

});