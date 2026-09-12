/* eslint-disable no-control-regex */
function getBigramJaccardSimilarity(str1, str2) {
  const getBigrams = (str) => {
    const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const bigrams = new Set();
    for (let i = 0; i < clean.length - 1; i++) {
      bigrams.add(clean.substring(i, i + 2));
    }
    return bigrams;
  };
  const set1 = getBigrams(str1);
  const set2 = getBigrams(str2);
  if (set1.size === 0 || set2.size === 0) {
    return 0;
  }
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

export function runMetaAnalysis(priorFindings, currentFindings, round) {
  const metaFindingsList = [];
  const newFindings = [];
  const warnings = [];

  if (priorFindings !== null && currentFindings.length > 0) {
    // 1. Compare review-report.json between cycles: Check for same item recurring
    for (const curr of currentFindings) {
      let currDesc = curr.finding || curr.description || '';
      currDesc = currDesc.replace(/[\x00-\x1F\x7F-\x9F]/g, '').substring(0, 1000);
      for (const prior of priorFindings) {
        let priorDesc = prior.finding || prior.description || '';
        priorDesc = priorDesc.replace(/[\x00-\x1F\x7F-\x9F]/g, '').substring(0, 1000);
        if (curr.file === prior.file) {
          const currClean = currDesc.toLowerCase().replace(/[^a-z0-9]/g, '');
          const priorClean = priorDesc.toLowerCase().replace(/[^a-z0-9]/g, '');

          const getCodes = (text) => {
            const matches = text.match(/\b(CVD-[A-Z0-9-]+|F[0-9]+)\b/g) || [];
            return new Set(matches);
          };
          const currCodes = getCodes(currDesc);
          const priorCodes = getCodes(priorDesc);
          const sharedCodes = [...currCodes].filter((x) => priorCodes.has(x));

          const isDuplicate =
            currClean === priorClean ||
            currClean.includes(priorClean) ||
            priorClean.includes(currClean) ||
            sharedCodes.length > 0 ||
            getBigramJaccardSimilarity(currDesc, priorDesc) >= 0.45;

          if (isDuplicate) {
            console.error(`❌ [CONVERGENCE VIOLATION] Remediation Loop Detected on Round ${round + 1}!`);
            console.error(`   The same finding continues to recur under: ${curr.file}`);
            console.error(`   Finding: "${currDesc}"`);
            warnings.push(`❌ [CONVERGENCE VIOLATION] Remediation Loop Detected on Round ${round + 1}!`);
            warnings.push(`   The same finding continues to recur under: ${curr.file}`);
            warnings.push(`   Finding: "${currDesc}"`);
            metaFindingsList.push(
              `HIGH | ${curr.file} | **System Stability Defect (Remediation Loop)**: The finding "${currDesc}" under file "${curr.file}" has recurred across consecutive cycles. Either the auto-remediation failed to resolve it, or the stateful ignore failed to suppress it. Adjust agent prompting or resolve implementation rigidity.`,
            );
          }
        }
      }
    }

    // 2. Compare review-report.json between cycles: Check for brand-new findings (scope drift)
    for (const curr of currentFindings) {
      let currDesc = curr.finding || curr.description || '';
      currDesc = currDesc.replace(/[\x00-\x1F\x7F-\x9F]/g, '').substring(0, 1000);
      let foundMatch = false;
      for (const prior of priorFindings) {
        let priorDesc = prior.finding || prior.description || '';
        priorDesc = priorDesc.replace(/[\x00-\x1F\x7F-\x9F]/g, '').substring(0, 1000);
        if (curr.file === prior.file) {
          const currClean = currDesc.toLowerCase().replace(/[^a-z0-9]/g, '');
          const priorClean = priorDesc.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (
            currClean.includes(priorClean) ||
            priorClean.includes(currClean) ||
            getBigramJaccardSimilarity(currDesc, priorDesc) >= 0.45
          ) {
            foundMatch = true;
            break;
          }
        }
      }
      if (!foundMatch) {
        newFindings.push(curr);
      }
    }
  }

  return { metaFindingsList, newFindings, warnings };
}
