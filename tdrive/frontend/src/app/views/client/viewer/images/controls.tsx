import { Button } from '@atoms/button/button';
import { ZoomOutIcon, ZoomInIcon, RotateCwIcon } from '@atoms/icons-agnostic';
import { getImageControls } from './display';

export default () => {
  return (
    <>
      <Button
        iconSize="lg"
        className="ml-4 !rounded-full"
        theme="dark"
        size="lg"
        icon={ZoomOutIcon}
        onClick={() => getImageControls().zoomOut()}
        testClassId="image-control-button-zoom-out"
      />
      <Button
        iconSize="lg"
        className="ml-4 !rounded-full"
        theme="dark"
        size="lg"
        icon={ZoomInIcon}
        onClick={() => getImageControls().zoomIn()}
        testClassId="image-control-button-zoom-in"
      />
      <Button
        iconSize="lg"
        className="ml-4 !rounded-full"
        theme="dark"
        size="lg"
        icon={RotateCwIcon}
        onClick={() => getImageControls().rotateCw()}
        testClassId="image-control-button-rotate"
      />
    </>
  );
};
