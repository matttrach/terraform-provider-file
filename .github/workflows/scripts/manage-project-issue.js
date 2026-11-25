// manage-project-issue.js - Updates linked issue status in GitHub Organization Project.
// Conforms to github-script.instructions.md guidelines.

export function extractIssueNumbers(text) {
  if (!text) {
    return [];
  }
  const regex = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?|issue)\s*#(\d+)/gi;
  const issues = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    issues.push(parseInt(match[1], 10));
  }
  return [...new Set(issues)];
}

export default async ({ github, context, core, process }) => {
  const enabled = process.env.FEATURE_ISSUE_MANAGEMENT;
  if (enabled !== 'true') {
    core.info('Issue Management feature is disabled in .github/repo-config.yml. Passing gracefully.');
    return;
  }

  const targetStatus = process.env.TARGET_STATUS; // e.g. "In Review" or "Ready for QA"
  if (!targetStatus) {
    core.setFailed('TARGET_STATUS environment variable is required.');
    return;
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const prNumber = process.env.PR_NUMBER || context.payload?.pull_request?.number;

  let issueNumbers = [];

  if (prNumber) {
    core.info(`Fetching details for PR #${prNumber} to extract linked issue numbers...`);
    const { data: pr } = await github.rest.pulls.get({
      owner,
      repo,
      pull_number: parseInt(prNumber, 10),
    });

    issueNumbers = extractIssueNumbers(`${pr.title}\n${pr.body || ''}`);
  } else if (context.payload?.commits) {
    const messages = context.payload.commits.map((c) => c.message).join('\n');
    issueNumbers = extractIssueNumbers(messages);
  }

  if (issueNumbers.length === 0) {
    core.info('No linked issue references found in PR/commit metadata. Skipping project updates.');
    return;
  }

  core.info(`==> Found linked issues: ${issueNumbers.join(', ')}. Target status: "${targetStatus}"`);

  for (const issueNum of issueNumbers) {
    core.info(`Inspecting Organization Project association for Issue #${issueNum}...`);

    const query = `
      query($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $issueNumber) {
            id
            projectV2Items(first: 10) {
              nodes {
                id
                project {
                  id
                  title
                  fields(first: 50) {
                    nodes {
                      ... on ProjectV2SingleSelectField {
                        id
                        name
                        options {
                          id
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    let data;
    try {
      data = await github.graphql(query, {
        owner,
        repo,
        issueNumber: issueNum,
      });
    } catch (err) {
      core.warning(`Notice: GraphQL query failed for Issue #${issueNum}: ${err.message}`);
      continue;
    }

    const issue = data?.repository?.issue;
    if (!issue) {
      core.warning(`Notice: Issue #${issueNum} not found.`);
      continue;
    }

    const items = issue.projectV2Items?.nodes || [];
    if (items.length === 0) {
      core.info(`Issue #${issueNum} is not associated with any GitHub Organization Project.`);
      continue;
    }

    for (const item of items) {
      const project = item.project;
      const fields = project.fields?.nodes || [];
      const statusField = fields.find((f) => f.name && f.name.toLowerCase() === 'status');

      if (!statusField) {
        core.info(`Project "${project.title}" lacks a SingleSelect Status field.`);
        continue;
      }

      const targetOption = statusField.options.find(
        (opt) => opt.name && opt.name.toLowerCase() === targetStatus.toLowerCase(),
      );

      if (!targetOption) {
        core.info(
          `Status option "${targetStatus}" not found in Project "${project.title}". Available options: ${statusField.options.map((o) => o.name).join(', ')}`,
        );
        continue;
      }

      core.info(`Updating Issue #${issueNum} in Project "${project.title}" to "${targetOption.name}"...`);

      const mutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
          updateProjectV2ItemFieldValue(
            input: {
              projectId: $projectId
              itemId: $itemId
              fieldId: $fieldId
              value: { singleSelectOptionId: $optionId }
            }
          ) {
            projectV2Item {
              id
            }
          }
        }
      `;

      try {
        await github.graphql(mutation, {
          projectId: project.id,
          itemId: item.id,
          fieldId: statusField.id,
          optionId: targetOption.id,
        });
        core.info(`🟢 Issue #${issueNum} status set to "${targetOption.name}" in Project "${project.title}".`);
      } catch (err) {
        core.warning(`Error updating field on Project "${project.title}": ${err.message}`);
      }
    }
  }
};
