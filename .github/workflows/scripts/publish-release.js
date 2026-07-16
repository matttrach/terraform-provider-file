export default async ({ github, context, core, process }) => {
  const version = process.env.VERSION;
  const tag = version.startsWith('v') ? version : `v${version}`;

  const { data: releases } = await github.rest.repos.listReleases({
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
  } else {
    core.info(`Release for tag ${tag} is already published.`);
  }
};
