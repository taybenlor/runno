(window as any).selectDockerImage = (event: any) => {
  console.log("gday");
  const target = event.target as HTMLInputElement;
  const file = (target.files || [])[0];
  const url = URL.createObjectURL(file);
  const src = url.toString();
  if (!target.nextElementSibling) {
    throw new Error("whoops");
  }
  target.nextElementSibling.innerHTML = `<runno-container src="${src}" controls></runno-container>`;
};
