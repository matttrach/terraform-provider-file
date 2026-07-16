export default async ({ github, context, core, process }) => {
  await github.rest.issues.createComment({
    issue_number: parseInt(process.env.PR_NUMBER, 10),
    owner: process.env.GITHUB_OWNER,
    repo: process.env.REPO_NAME,
    body: process.env.TEST_STATUS === 'passed' ? "Tests Passed!" : "Tests Failed!"
  });
};
