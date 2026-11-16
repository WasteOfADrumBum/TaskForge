import React from 'react';

// A main landmark and a way back, so screen-reader and keyboard users aren't stranded.
const NotFoundPage: React.FC = () => {
  return (
    <main style={{ padding: '4rem 1.5rem', maxWidth: '40rem', margin: '0 auto' }}>
      <h1>404 - Page Not Found</h1>
      <p>
        <a href="/">Go to the TaskForge home page</a>
      </p>
    </main>
  );
};

export default NotFoundPage;
