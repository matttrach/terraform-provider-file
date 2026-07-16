export default async ({ github, context, core, process }) => {
  const maintainers = JSON.parse(process.env.TERRAFORM_MAINTAINERS);
  const isMaintainer = maintainers.includes(context.actor);
  return isMaintainer;
};
