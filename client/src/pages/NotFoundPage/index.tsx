// A main landmark and a way back, so screen-reader and keyboard users aren't stranded.
const NotFoundPage = () => (
  <main className="os-container-sm os-py-16 os-px-6">
    <h1 className="tf-h1 os-mb-4">404 - Page Not Found</h1>
    <p className="os-m-0">
      <a href="/">Go to the TaskForge home page</a>
    </p>
  </main>
);

export default NotFoundPage;
