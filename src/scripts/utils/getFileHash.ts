import fs from "node:fs";
import crypto from "node:crypto";

const getFileHash = (path: string) => {
    const fileBuffer = fs.readFileSync(path);
    const hashSum = crypto.createHash("sha256");

    hashSum.update(fileBuffer);

    const hex = hashSum.digest("hex");

    return hex.slice(0, 8);
};

export default getFileHash;
