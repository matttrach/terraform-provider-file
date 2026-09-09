export default async ({ context, core, process }) => {
  try {
    const maintainersRaw = process.env.TERRAFORM_MAINTAINERS;
    if (!maintainersRaw) {
      throw new Error('TERRAFORM_MAINTAINERS environment variable is not defined');
    }
    let maintainers = [];
    try {
      const parsed = JSON.parse(maintainersRaw);
      if (Array.isArray(parsed)) {
        maintainers = parsed;
      } else {
        await core.warning('TERRAFORM_MAINTAINERS JSON did not parse to an Array. Initializing empty.');
      }
    } catch (parseErr) {
      await core.warning(`Failed to parse TERRAFORM_MAINTAINERS JSON: ${parseErr.message}`);
    }
    const actorRaw = context.actor || 'unknown';
    const actor = actorRaw.replace(/[^a-zA-Z0-9_-]/g, '');
    const isMaintainer = maintainers.includes(actor);
    await core.info(`Actor: ${actor}, Is Maintainer: ${Boolean(isMaintainer)}`);
    await core.setOutput('is_maintainer', isMaintainer);
  } catch (err) {
    await core.setFailed(`Error checking maintainer status: ${err.message}`);
    await core.setOutput('is_maintainer', false);
  }
};
