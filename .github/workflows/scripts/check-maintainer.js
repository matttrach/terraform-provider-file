export default async ({ github, context, core, process }) => {
  try {
    const maintainersRaw = process.env.TERRAFORM_MAINTAINERS;
    if (!maintainersRaw) {
      throw new Error("TERRAFORM_MAINTAINERS environment variable is not defined");
    }
    const maintainers = JSON.parse(maintainersRaw);
    const actor = context.actor;
    const isMaintainer = maintainers.includes(actor);
    core.info(`Actor: ${actor}, Is Maintainer: ${isMaintainer}`);
    return isMaintainer;
  } catch (error) {
    core.setFailed(`Error checking maintainer status: ${error.message}`);
    return false;
  }
};
