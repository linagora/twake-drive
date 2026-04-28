export const downloadFile = async (client, file) => {
  return client
    .collection('io.cozy.files', { driveId: file.driveId })
    .download(file)
}
