export default async ({ github, context, core, process }) => {
  try {
    const version = process.env.VERSION;
    if (!version) {
      throw new Error("VERSION environment variable is required");
    }
    const tag = version.startsWith('v') ? version : `v${version}`;

    core.info(`Listing releases to find tag ${tag}...`);
    const releases = await github.paginate(github.rest.repos.listReleases, {
      owner: context.repo.owner,
      repo: context.repo.repo,
    });

    const release = releases.find(r => r.tag_name === tag);
    if (!release) {
      core.setFailed(`Could not find release for tag ${tag}`);
      return;
    }

    if (release.draft) {
      core.info(`Publishing release ID ${release.id} for tag ${tag}`);
      await github.rest.repos.updateRelease({
        owner: context.repo.owner,
        repo: context.repo.repo,
        release_id: release.id,
        draft: false
      });
      core.info(`Successfully published release for tag ${tag}`);
    } else {
      core.info(`Release for tag ${tag} is already published.`);
    }
  } catch (error) {
    core.setFailed(`Failed to publish release: ${error.message}`);
  }
};
