import _ from "lodash";
import { isUndefined } from "lodash";

interface CheckboxSliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean;
  disabled?: boolean;
  noFocusBorder?: boolean;
  testClassId?: string;
}
/** Just classes up a checkbox to look like a slider. Deviates from onChange etc for
 * compatibility with `InputHTMLAttributes<HTMLInputElement>`, to expose eg. id to use with htmlFor.
 */
export const CheckboxSlider = (props: CheckboxSliderProps) => {
  let styles = {};
  const noFocus = isUndefined(props.noFocusBorder) ? true : props.noFocusBorder;
  if (noFocus) styles = {boxShadow: "none", borderColor: "inherit"};

  return (
    <input
      {..._.omit(props, 'testClassId')}
      type="checkbox"
      role="switch"
      style={styles}
      // @author https://tw-elements.com/docs/react/forms/switch/
      className={[
        "!bg-none mr-2 mt-[0.3rem] h-7 w-14 appearance-none rounded-[0.9rem] bg-neutral-300 before:pointer-events-none before:absolute before:h-7 before:w-5 before:rounded-full before:bg-transparent before:content-[''] after:absolute after:z-[2] after:mt-[0.2rem] after:ml-[0.2rem] after:h-5 after:w-5 after:rounded-full after:border-none after:bg-neutral-100 after:shadow-[0_0px_3px_0_rgb(0_0_0_/_7%),_0_2px_2px_0_rgb(0_0_0_/_4%)] after:transition-[background-color_0.2s,transform_0.2s] after:content-[''] checked:bg-primary checked:after:absolute checked:after:z-[2] checked:after:ml-[1.9625rem] checked:after:w-5 checked:after:rounded-full checked:after:border-none checked:after:bg-primary checked:after:shadow-[0_3px_1px_-2px_rgba(0,0,0,0.2),_0_2px_2px_0_rgba(0,0,0,0.14),_0_1px_5px_0_rgba(0,0,0,0.12)] checked:after:transition-[background-color_0.2s,transform_0.2s] checked:after:content-[''] hover:cursor-pointer dark:bg-neutral-600 dark:after:bg-white dark:checked:bg-primary dark:checked:after:bg-primary disabled:cursor-default disabled:opacity-25 !focus:shadow-none",
        `testid:${props.testClassId}`
      ].join(' ')}
      checked={!!props.checked}
      disabled={props.disabled}
      data-checkbox-id={props.testClassId}
    />)
}
