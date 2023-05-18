// shout out to kaspa-rpc-client
const { ClientWrapper, Wallet } = require("kaspa-rpc-client")
const fs = require('fs');


// Setup Conf
const KASPA_NODE_URL = "seeder2.kaspad.net:16110";
const VERBOS_ENABLE = false;
const SPLIT_SIZE = 3;
const GAS = 0.001;

const airdropFile = process.argv[2];
const amount = parseFloat(process.argv[3]);
const payback = process.argv[4];

let client;
let account;
let address;
let airdropList;

const kaspa = {
    "getBalance" : async (_address) => {return await client.getBalanceByAddress({
        address:
          _address,
      })},
    "sendBack" : async () => {
        const tx = await account.sendAll({
            recipient: payback,
          });
        console.log("sending back: ",tx);
    },
    "send" : async (_output) => {
        const tx = await account.send({
            outputs: _output,
            changeAddress: address,
          })
    }

}

async function main(){
    await init();
    await generateWallet();
    readAndAirdrop();
}

async function init(){
    const wrapper = new ClientWrapper({
        hosts: [KASPA_NODE_URL],
        verbose: VERBOS_ENABLE,
      })
    await wrapper.initialize();
    client = await wrapper.getClient();
}

async function generateWallet(){
    console.log("generating temp wallet ...");
    const { phrase, entropy } = Wallet.randomMnemonic()
    console.log("Plz keep the phrase safe(dont use it for other purposes): %s",phrase);
    const wallet = Wallet.fromPhrase(client, phrase);
    account = await wallet.account();
    address = (await account.address()).address;
    console.log("Temp address is ",address);
    console.log("wallet balance : ", (await kaspa.getBalance(address)).balance);
}

function readAndAirdrop() {
    fs.readFile(airdropFile, 'utf8', async (err, data) => {
        if (err) {
          console.error(err);
          return;
        }
        // split by line
        airdropList = data.split('\n');
        console.log("airdropList loaded, %d addresses", airdropList.length);
        await airdrop();
    })
}

async function airdrop() {
    const len = airdropList.length;
    const singleAmount = amount;
    const totalAmount = amount * len  + GAS;
    console.log("for each user : ", singleAmount);

    const drop = async(start) => {
        const startInd = start;
        const endInd = Math.min(len-1,startInd + SPLIT_SIZE-1);
        output = []
        for (ind = startInd; ind <= endInd; ind++){
            output.push({
                recipient: airdropList[ind],
                amount: BigInt(singleAmount*1e8),
            })
        }
        console.log("sending ", output);
        await kaspa.send(output);

        if (endInd == len-1){
            console.log("finished");
            setTimeout(async ()=>{
                await kaspa.sendBack();
                console.log("finish.. thank you for using")
            },5000)
        }else{
            setTimeout(async () => {
                await drop(start + SPLIT_SIZE);
              }, 8000);
        }
    }

    const check = async () => {
        console.log("plz send to fill %d",totalAmount);
        const balance = (await kaspa.getBalance(address)).balance/1e8;
        console.log("wallet %s balance : ", address, balance);
        if (balance < totalAmount){
            setTimeout(check, 3000);
        }else{
            await drop(0);
        }
    }

    await check();

}

main();