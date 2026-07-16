export default async ({ github, context, core, process }) => {
  await github.rest.issues.createComment({
    issue_number: parseInt(process.env.PR_NUMBER, 10),
    owner: process.env.GITHUB_OWNER,
    repo: process.env.REPO_NAME,
    body: `Please make sure e2e tests pass before merging this PR! \n ${process.env.SERVER_URL}/${process.env.REPOSITORY}/actions/runs/${process.env.RUN_ID}`
  });
};
