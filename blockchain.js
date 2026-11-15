// ChainShare Blockchain

class Block {

    constructor(index, timestamp, data, previousHash = "") {

        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.hash = "";
    }

    async calculateHash() {

        const blockData =
            this.index +
            this.timestamp +
            JSON.stringify(this.data) +
            this.previousHash;

        const encoder = new TextEncoder();

        const data = encoder.encode(blockData);

        const hashBuffer = await crypto.subtle.digest(
            "SHA-256",
            data
        );

        const hashArray = Array.from(
            new Uint8Array(hashBuffer)
        );

        return hashArray.map(
            byte => byte.toString(16).padStart(2, "0")
        ).join("");
    }
}
// ChainShare Blockchain Class

class Blockchain {

    constructor() {
    this.chain = [];

    const savedChain = localStorage.getItem("chainShareBlockchain");

    if (savedChain) {
        try {
            const records = JSON.parse(savedChain);

            this.chain = records.map(record => {
                const block = new Block(
                    record.index,
                    record.timestamp,
                    record.data,
                    record.previousHash
                );

                block.hash = record.hash;

                return block;
            });

        } catch (error) {
            console.error("Blockchain loading failed:", error);
            this.chain = [];
        }
    }
}

saveChain() {
    localStorage.setItem(
        "chainShareBlockchain",
        JSON.stringify(this.chain)
    );
}

    async createGenesisBlock() {
        if (this.chain.length >0)return;

        const genesisBlock = new Block(
            0,
            new Date().toISOString(),
            "Genesis Block",
            "0"
        );

        genesisBlock.hash = await genesisBlock.calculateHash();

        this.chain.push(genesisBlock);
        this.saveChain();
    }

    async addBlock(data) {

        const previousBlock = this.chain[this.chain.length - 1];

        const newBlock = new Block(
            this.chain.length,
            new Date().toISOString(),
            data,
            previousBlock.hash
        );

        newBlock.hash = await newBlock.calculateHash();

        this.chain.push(newBlock);
        this.saveChain();

        return newBlock;
    }

    // Verify Blockchain

    async isChainValid() {

        for (let i = 0; i < this.chain.length; i++) {

            const currentBlock = this.chain[i];

            const calculatedHash =
                await currentBlock.calculateHash();


            if (currentBlock.hash !== calculatedHash) {
                return false;
            }

            if (i > 0) {

                const previousBlock = this.chain[i - 1];

                if (
                    currentBlock.previousHash !== previousBlock.hash
                ) {
                    return false;
                }
            }
        }

        return true;
    }
}