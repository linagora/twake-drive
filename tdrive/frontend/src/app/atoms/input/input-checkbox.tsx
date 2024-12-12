import { CheckOutlineIcon } from '../icons-agnostic';
import { Base, BaseSmall } from '../text';

export const Checkbox = (props: {
  label?: string;
  labelNormalSize?: boolean;
  onChange?: (status: boolean) => void;
  value?: boolean;
  className?: string;
  disabled?: boolean;
  testClassId?: string;
}) => {
  const renderSwitch = () => {
    const className = props.className || '';

    const testId = props.testClassId ? `testid:${props.testClassId}` : '';

    return (
      <div
        className={
          ' flex justify-center items-center w-6 h-6 border-2 rounded-full text-white ' +
          (props.value
            ? 'border-blue-500 bg-blue-500 hover:border-blue-600 hover:bg-blue-600'
            : 'border-zinc-300 ' + (props.disabled ? '' : 'hover:border-blue-300')) +
          ' ' +
          (props.disabled ? 'opacity-50' : 'cursor-pointer') +
          ' ' +
          (className || '') + ' ' +
          testId
        }
        onClick={() =>
          !props.label && !props.disabled && props.onChange && props.onChange(!props.value)
        }
      >
        {props.value && <CheckOutlineIcon className="m-icon-small" />}
      </div>
    );
  };

  if (props.label) {
    return (
      <div
        className={'flex flex-row items-center'}
        onClick={() => {
          if (!props.disabled) {
            props.onChange && props.onChange(!props.value);
          }
        }}
      >
        {renderSwitch()}
        {props.labelNormalSize
          ? <Base className={'ml-2 ' + (props.disabled ? 'opacity-50' : 'cursor-pointer')}>
              {props.label}
            </Base>
          : <BaseSmall className={'ml-2 ' + (props.disabled ? 'opacity-50' : 'cursor-pointer')}>
              {props.label}
            </BaseSmall>
          }
      </div>
    );
  } else {
    return renderSwitch();
  }
};
