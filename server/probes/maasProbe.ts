import { loadRuntimeConfig } from "../config.js";
import { createMaaSReasoningProvider } from "../maasReasoning.js";

const config = loadRuntimeConfig();
const model = process.argv[2] ?? "gpt-oss-120b";
const result = await createMaaSReasoningProvider(config).forModel(model).probe();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.success ? 0 : 1;
