const assert = require("assert");
const Web3 = require("web3");
const ZeusProvider = require("..");
const nock = require("nock");

describe("Basic tests", function() {

    let web3;
    let zeusProvider;

    describe("Initialization", function() {

        beforeEach(() => {
            zeusProvider = new ZeusProvider({
                rpcApis: [
                    "https://localhost:1111",
                    "https://localhost:2222"
                ],
                privateKeys: [
                    "FCAFC28AF87287F3AB81554C2DF38C3FCE6E2C7654DB7710243A2D52A9EDF441"
                ]
            });
            web3 = new Web3(zeusProvider);
        });

        it("Should instantiate ZeusProvider", () => {
            assert.equal(typeof zeusProvider, "object");
        });

        it("Should initialize web3 with ZeusProvider", async () => {
            assert.equal(web3.currentProvider, zeusProvider);
        });

        it("Should be able to retrieve block number", async () => {

            const expectedBlockNumber = 100500;
            const handler = nock("https://localhost:1111")
                .post("/", (body) => { // { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }
                    return body.method === "eth_blockNumber";
                })
                .reply(200, (_, body) => ({
                    jsonrpc: "2.0",
                    id: body.id,
                    result: expectedBlockNumber
                }));
            const block = await web3.eth.getBlockNumber();
            
            assert.equal(block, expectedBlockNumber);
            handler.done();

        });

    });

});