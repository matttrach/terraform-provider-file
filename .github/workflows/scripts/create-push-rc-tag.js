export default async ({ github, context, core, process }) => {
  const targetVersion = process.env.TARGET_VERSION;
  if (!targetVersion) {
    core.setFailed("TARGET_VERSION is required");
    return;
  }

  const baseVersion = `v${targetVersion}`;
  core.info(`Base version from release-please is: ${baseVersion}`);

  try {
    const tags = await github.paginate(github.rest.repos.listTags, {
      owner: context.repo.owner,
      repo: context.repo.repo,
    });

    const rcPrefix = `${baseVersion}-rc.`;
    let latestRcNum = -1;

    for (const tag of tags) {
      if (tag.name.startsWith(rcPrefix)) {
        const numStr = tag.name.substring(rcPrefix.length);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > latestRcNum) {
          latestRcNum = num;
        }
      }
    }

    const nextRcNum = latestRcNum + 1;
    const nextRcTag = `${rcPrefix}${nextRcNum}`;
    core.info(`Calculated next RC tag: ${nextRcTag}`);

    await github.rest.git.createRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: `refs/tags/${nextRcTag}`,
      sha: context.sha,
    });

    core.info(`Successfully created tag ${nextRcTag}`);
    core.setOutput("rc_tag", nextRcTag);

  } catch (error) {
    core.setFailed(`Failed to create RC tag: ${error.message}`);
  }
};
