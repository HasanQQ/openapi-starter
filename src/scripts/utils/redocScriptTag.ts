const parseRedocScriptTag = (scriptHTML: string) => {
    // get __redoc_state variable from redoc stript
    const { spec, ...others } = JSON.parse(scriptHTML.match(/const __redoc_state = (.*?);$/m)![1]);

    const stateNew = JSON.stringify({ ...others, spec: { data: {} } }).replace(
        '"spec":{"data":{}}',
        '"spec":{"data":response}'
    );

    const code = [
        'fetch("specs/openapi.json")',
        ".then(response => response.json())",
        `.then(response => Redoc.hydrate(${stateNew}, document.getElementById("redoc")))`,
    ].join("");

    return {
        code: code,
        spec: spec.data!,
    };
};

export default parseRedocScriptTag;
