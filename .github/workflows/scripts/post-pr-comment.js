export default async ({ github, context, core, process }) => {
  try {
    const issueNumber = parseInt(process.env.PR_NUMBER, 10);
    const owner = process.env.GITHUB_OWNER || context.repo.owner;
    const repo = process.env.REPO_NAME || context.repo.repo;
    const body = process.env.COMMENT_BODY;

    if (!issueNumber) {
      throw new Error("PR_NUMBER environment variable is required");
    }
    if (!body) {
      throw new Error("COMMENT_BODY environment variable is required");
    }

    core.info(`Posting comment to ${owner}/${repo} PR #${issueNumber}...`);
    await github.rest.issues.createComment({
      issue_number: issueNumber,
      owner,
      repo,
      body,
    });
    core.info("Comment posted successfully.");
  } catch (error) {
    core.setFailed(`Failed to post comment: ${error.message}`);
  }
};
