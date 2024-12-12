export default (props: { download: string; name: string }) => {
  const url =
    '/public/viewer/PDFViewer/viewer.html' + '?link=' + encodeURIComponent(props.download);
  return (
    <>
      <iframe
        className="w-full h-full left-0 right-0 absolute bottom-0 top-0 testid:pdf-display"
        title={props.name}
        src={url}
      />
    </>
  );
};
