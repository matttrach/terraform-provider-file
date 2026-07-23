export default async ({ github, context, core, process }) => {
  try {
    const sha = process.env.SHA || context.sha;
    const calculateNextRc = process.env.CALCULATE_NEXT_RC === 'true';
    
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    let targetTag = "";

    if (calculateNextRc) {
      const targetVersion = process.env.TARGET_VERSION;
      if (!targetVersion) {
        throw new Error("TARGET_VERSION environment variable is required when CALCULATE_NEXT_RC is true");
      }

      const baseVersion = targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`;
      core.info(`Calculating next RC tag for base version: ${baseVersion}`);

      const tags = await github.paginate(github.rest.repos.listTags, {
        owner,
        repo,
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
      targetTag = `${rcPrefix}${nextRcNum}`;
      core.info(`Calculated next RC tag: ${targetTag}`);
    } else {
      // Direct tag mode
      const rawTag = process.env.TAG || process.env.VERSION;
      if (!rawTag) {
        throw new Error("Either TAG, VERSION, or CALCULATE_NEXT_RC environment variable must be specified");
      }
      targetTag = rawTag.startsWith('v') ? rawTag : `v${rawTag}`;
    }

    core.info(`Target Tag: ${targetTag}`);
    core.info(`Target SHA: ${sha}`);

    // Check if tag already exists using the API
    let tagExists = false;
    try {
      await github.rest.git.getRef({
        owner,
        repo,
        ref: `tags/${targetTag}`,
      });
      tagExists = true;
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
    }

    if (tagExists) {
      core.info(`Tag ${targetTag} already exists on remote.`);
      if (calculateNextRc) {
        throw new Error(`Calculated RC tag ${targetTag} already exists on remote. This should not happen.`);
      }
      return;
    }

    // Create the tag reference
    core.info(`Creating tag ref refs/tags/${targetTag} pointing to ${sha}...`);
    await github.rest.git.createRef({
      owner,
      repo,
      ref: `refs/tags/${targetTag}`,
      sha,
    });

    core.info(`Successfully created tag ${targetTag}`);
    
    // Set outputs for downstream steps if needed
    core.setOutput("tag", targetTag);
    if (calculateNextRc) {
      core.setOutput("rc_tag", targetTag);
    }
  } catch (error) {
    core.setFailed(`Failed to create tag: ${error.message}`);
  }
};
