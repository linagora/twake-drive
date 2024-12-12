import { Button } from '@atoms/button/button';
import Languages from '@features/global/services/languages-service';

export default (props: { download: string; name: string }) => {
  return (
    <>
      <div className="text-white m-auto w-full text-center block h-full flex items-center testid:archive-display">
        <span className="block w-full text-center mt-16">
          {props.name}
          <br />
          <br />
          <Button theme="dark" testClassId="button-download">{Languages.t('scenes.apps.drive.download_button')}</Button>
        </span>
      </div>
    </>
  );
};
