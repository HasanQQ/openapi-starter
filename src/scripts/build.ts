import fs from "node:fs";
import cp from "node:child_process";
import * as cheerio from "cheerio";
import { convert as convertToPostmanColletion, Options as PostmanOptions } from "openapi-to-postmanv2";
import redocScriptTag from "./utils/redocScriptTag";
import getFileHash from "./utils/getFileHash";

const DIR_DIST = "./dist";
const DIR_PUBLIC = "./public";

const DIST_INDEX = `${DIR_DIST}/index.html`;
const DIST_FAVICON = `${DIR_DIST}/favicon.ico`;
const DIST_CSS_CUSTOM = `${DIR_DIST}/assets/style.css`;

const DIST_SPEC_DIR = `${DIR_DIST}/specs`;
const DIST_SPEC_OPENAPI = `${DIST_SPEC_DIR}/openapi.json`;
const DIST_SPEC_POSTMAN = `${DIST_SPEC_DIR}/postman-collection.json`;

(() => {
    // rempve the dist directory
    fs.rmSync(DIR_DIST, { recursive: true, force: true });

    // copy all files from public into dist
    fs.cpSync(DIR_PUBLIC, DIR_DIST, { recursive: true });

    // build the static doc
    cp.execSync(`npx redocly build-docs --output=${DIST_INDEX}`, { stdio: "inherit" });

    // get the generated html from file
    const $ = cheerio.loadBuffer(fs.readFileSync(DIST_INDEX));

    // get generated inlie css
    const $style = $('style[data-styled="true"]');

    // get generated inlie script with state and spec
    const $script = $("script").last();

    // get the spec and script code without spec (fetch)
    const { code: $scriptCode, spec: specOpenAPI } = redocScriptTag($script.html()!);

    // get css files (inline & style.css)
    const cssInline = $style.html();
    const cssCustom = fs.readFileSync(DIST_CSS_CUSTOM).toString();

    const cssCustomUgly = cssCustom.replaceAll("\n", " ").replaceAll(/[ ]+/g, " ");

    // merge css files into single file
    fs.writeFileSync(DIST_CSS_CUSTOM, [cssCustomUgly, cssInline].join("\n"));

    // create specs folder
    fs.mkdirSync(DIST_SPEC_DIR);

    // create openapi.json
    fs.writeFileSync(DIST_SPEC_OPENAPI, JSON.stringify(specOpenAPI));

    // read postman config
    const configPostman = fs.readFileSync("./postman-converter.json").toString();
    const configPostmanJSON = JSON.parse(configPostman) as PostmanOptions;

    // build postman collection from OpenAPI spec
    convertToPostmanColletion({ type: "json", data: specOpenAPI }, configPostmanJSON, (err, result) => {
        if (!result.result) {
            return;
        }

        // postman converter does not handle tag names
        const displayNamesOfTags: { [key: string]: string } = {};

        // collect display names from Open API spec
        specOpenAPI.tags?.forEach((tag: { name: string; "x-displayName"?: string }) => {
            if (tag["x-displayName"]) {
                displayNamesOfTags[tag.name] = tag["x-displayName"];
            }
        });

        //
        const specPostmanCollection = result.output[0].data;

        // check the top level items
        specPostmanCollection.item?.map((item) => {
            // if it is a tag override it
            if (displayNamesOfTags[item.name!]) {
                item.name = displayNamesOfTags[item.name!];
            }

            return item;
        });

        // create postman-collection.json
        fs.writeFileSync(DIST_SPEC_POSTMAN, JSON.stringify(specPostmanCollection));
    });

    // update the meta["name="description"]
    if (specOpenAPI["info"]["x-meta"] && specOpenAPI["info"]["x-meta"]["description"]) {
        $('meta[name="description"]').attr("content", specOpenAPI["info"]["x-meta"]["description"]);
    }

    // add version string for some files
    $('link[href="favicon.png"]').attr("href", `favicon.png?v=${getFileHash(DIST_FAVICON)}`);
    $('link[href="assets/style.css"]').attr("href", `assets/style.css?v=${getFileHash(DIST_CSS_CUSTOM)}`);

    const vOpenAPISpec = getFileHash(DIST_SPEC_OPENAPI);
    const vPostmanSpec = getFileHash(DIST_SPEC_POSTMAN);

    // create a list for download buttons
    $("<ul/>")
        .addClass("spec-dl-buttons")
        .append(
            $("<li/>").html(
                $("<a/>") //
                    .attr("href", `specs/openapi.json?v=${vOpenAPISpec}`)
                    .attr("download", "openapi.json")
                    .text("OpenAPI Spec")
            )
        )
        .append(
            $("<li/>").html(
                $("<a/>") //
                    .attr("href", `specs/postman-collection.json?v=${vPostmanSpec}`)
                    .attr("download", "postman-collection.json")
                    .text("Postman Collection")
            )
        )
        // there is no hydration error inside this
        .appendTo('div[data-role="redoc-summary"]');

    // remove inline css from document
    $style.remove();

    // update redoc script with new code
    $script.html($scriptCode.replace("specs/openapi.json", `specs/openapi.json?v=${vOpenAPISpec}`));

    // remove unnecessary "html" attributes
    $("body *[html]").removeAttr("html");

    // update the index html
    fs.writeFileSync(DIST_INDEX, $.html());

    //
})();
