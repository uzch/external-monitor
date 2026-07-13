import { loadRuntimeConfig } from "../config.js";
import { benchmarkMaaSModels } from "../maasReasoning.js";

const results = await benchmarkMaaSModels(loadRuntimeConfig());
process.stdout.write(`${JSON.stringify({ budgetUsd: 50, results }, null, 2)}\n`);
process.exitCode = results.every((result) => result.success) ? 0 : 1;
