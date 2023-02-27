import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { 
    Metaplex, 
    keypairIdentity, 
    bundlrStorage,
    toMetaplexFile,
    toBigNumber,
    CreateCandyMachineInput,
    DefaultCandyGuardSettings,
    CandyMachineItem,
    toDateTime,
    sol,
    TransactionBuilder,
    CreateCandyMachineBuilderContext
} from "@metaplex-foundation/js";
import secret from './guideSecret.json';
import { create } from "ts-node";

const QUICKNODE_RPC = 'https://api.devnet.solana.com/';
const SOLANA_CONNECTION = new Connection(QUICKNODE_RPC, { commitment: 'finalized' });

const WALLET = Keypair.fromSecretKey(new Uint8Array(secret));
const NFT_METADATA = 'https://bqp23v2j76qrmk5yqn73hbtbhntcfcwavvgia5gshk3wbqk54k4a.arweave.net/DB-t10n_oRYruIN_s4ZhO2YiisCtTIB00jq3YMFd4rg'; 
const COLLECTION_NFT_MINT = 'ACr7YVf2MB8JTDb5LThawXRVNMihR46Jgn5ZpMqK8Q8p';
const CANDY_MACHINE_ID = 'AQr3wxt8o5GsqMsumVQVVDeCbumX3j3J21PVcCbQJZXH';
const METAPLEX = Metaplex.make(SOLANA_CONNECTION)
    .use(keypairIdentity(WALLET))
    .use(bundlrStorage({
        address: 'https://devnet.bundlr.network',
        providerUrl: QUICKNODE_RPC,
        timeout: 60000,
    }));


async function createCollectionNft() {
    const{ nft: collectionNft } = await METAPLEX.nfts().create({
        name: "Dreams of Summer NFT Collection",
        uri: NFT_METADATA,
        sellerFeeBasisPoints: 0,
        isCollection: true,
        updateAuthority: WALLET,
    });

    console.log(`✅ - Minted Collection NFT: ${collectionNft.address.toString()}`);
    console.log(`     https://explorer.solana.com/address/${collectionNft.address.toString()}?cluster=devnet`);
}

// Run this once, then comment it out! Update COLLECTION_NFT_MINT with output
//createCollectionNft();
//
/* output:

$ ts-node app
✅ - Minted Collection NFT: ACr7YVf2MB8JTDb5LThawXRVNMihR46Jgn5ZpMqK8Q8p
     https://explorer.solana.com/address/ACr7YVf2MB8JTDb5LThawXRVNMihR46Jgn5ZpMqK8Q8p?cluster=devnet
*/


// The Metaplex SDK allows you to initiate a Candy Machine with a single line 🤯
// 
// But of course this relies on another function because this requires some settings
// Let's generate our settings with another function
async function generateCandyMachine() {
    const candyMachineSettings: CreateCandyMachineInput<DefaultCandyGuardSettings> = 
    {

        itemsAvailable: toBigNumber(3),     // Collection Size: 3
        sellerFeeBasisPoints: 1000,         // 10% Royalties on Collection
        symbol: "DOSPX",
        maxEditionSupply: toBigNumber(0),   // 0 reproductions of each NFT allowed
        isMutable: true,    // Once set to false, can't be changed back
        creators: [
            { address: WALLET.publicKey, share: 100 },
        ],
        collection: {
            address: new PublicKey(COLLECTION_NFT_MINT),    // from above
            updateAuthority: WALLET,
        },
    };

    // Now initiate Candy Machine
const { candyMachine } = await METAPLEX.candyMachines().create(candyMachineSettings); 

console.log(`✅ - Created Candy Machine: ${candyMachine.address.toString()}`);
console.log(`     https://explorer.solana.com/address/${candyMachine.address.toString()}?cluster=devnet`);
}

// adding candy guards at a separate step, for an exercise on updating candy 
// machine running.

//generateCandyMachine();

/* Output from generateCandyMachine:

$ ts-node app
✅ - Created Candy Machine: AQr3wxt8o5GsqMsumVQVVDeCbumX3j3J21PVcCbQJZXH
     https://explorer.solana.com/address/AQr3wxt8o5GsqMsumVQVVDeCbumX3j3J21PVcCbQJZXH?cluster=devnet

Use Machine ID to update above, and comment out call to generatecandyMachine!
*/

// Now let's add Candy Guards, which is new to V3
//
// Candy Guardsallow us to restrict access to the mint of a candy machine
// and add new features to it. They are modular, with mix-and-match types 
// such as NFT gate, Third party signer, Token burn, and others.
//
// Our mint will set a Start Date, a SOL Payment, and a limit of 2/user
//
async function updateCandyMachine() {
    const candyMachine = await METAPLEX
        .candyMachines()
        .findByAddress({ address: new PublicKey(CANDY_MACHINE_ID)});
    
        const {response } = await METAPLEX.candyMachines().update({
            candyMachine,
            // each guard has a specific Object Key with unique guard settings
            guards: {
                startDate: { date: toDateTime("2023-02-24T17:00:00Z")},
                mintLimit: {
                    id: 1,
                    limit: 2,
                },
                solPayment: {
                amount: sol(0.1),
                destination: METAPLEX.identity().publicKey,
                },
            }
        })
        console.log(`✅ - Updated Candy Machine: ${CANDY_MACHINE_ID}`);
        console.log(`     https://explorer.solana.com/tx/${response.signature}?cluster=devnet`);
}


// updateCandyMachine();

/* updateCandyMachine output:

$ ts-node app
✅ - Updated Candy Machine: AQr3wxt8o5GsqMsumVQVVDeCbumX3j3J21PVcCbQJZXH
     https://explorer.solana.com/tx/4cmHYCMH8xCWbUqfoMYVrXFp37qw3RV5VYU6p8fFnY6C4f6HQBZYiHhB8M2jQw8hN9JpZjxtoVACHP5f1SX31QtQ?cluster=devnet

     Now comment out updateCandyMachine() so it won't run again and we can proceed
*/

// Time to add some items to the Candy Machine.
// This is similar to updating, however we invoke .insertItems() instead.
//
async function addItems() {
    const candyMachine = await METAPLEX
        .candyMachines()
        .findByAddress({ address: new PublicKey(CANDY_MACHINE_ID)});
    const items = [];
    for (let i = 0; i < 3; i++) { // Add 3 NFTs (the size of our collection)
        items.push({
            // If you are adding unique NFT's add custom logic here
            // Keep in mind transaction size limits on Solana
            name: `Dreams of Summer NFT # ${i+1}`,
            uri: NFT_METADATA
        })
    }
    // Now insert the items
    const { response } = await METAPLEX.candyMachines().insertItems({
        candyMachine,
        items: items,
    }, {commitment: 'finalized'});

    console.log(`✅ - Items added to Candy Machine: ${CANDY_MACHINE_ID}`);
    console.log(`     https://explorer.solana.com/tx/${response.signature}?cluster=devnet`);
}

//addItems();

/* Results from addItems function

$ ts-node app
✅ - Items added to Candy Machine: AQr3wxt8o5GsqMsumVQVVDeCbumX3j3J21PVcCbQJZXH
     https://explorer.solana.com/tx/4rokmHZaTZjU3C9NsG6Jp9DhZr32DV4n2HJnhLN8xgKC17bP8pMCCrh1ZJBtiFfCQx3cyR53vTPqzYncrZUh6KX5?cluster=devnet

Now comment out the function and create another to mint NFTs!
*/

// Fetch candy machine and call a new method to mint, passing in our PubKey
// to mint our NFT! Log the results
async function mintNFT() {
    const candyMachine = await METAPLEX
        .candyMachines()
        .findByAddress({ address: new PublicKey(CANDY_MACHINE_ID)});
    let { nft, response } = await METAPLEX.candyMachines().mint({
        candyMachine,
        collectionUpdateAuthority: WALLET.publicKey,
    }, {commitment: 'finalized'})

    console.log(`✅ - Minted NFT: ${nft.address.toString()}`);
    console.log(`     https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`);
    console.log(`     https://explorer.solana.com/tx/${response.signature}?cluster=devnet`);
}

mintNFT();