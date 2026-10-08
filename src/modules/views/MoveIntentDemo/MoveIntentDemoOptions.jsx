import React from 'react'

import Checkbox from 'cozy-ui/transpiled/react/Checkbox'
import FormControlLabel from 'cozy-ui/transpiled/react/FormControlLabel'
import RadioGroup from 'cozy-ui/transpiled/react/RadioGroup'
import Radios from 'cozy-ui/transpiled/react/Radios'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'

export function MoveIntentDemoOptions({ form, onChange }) {
  const { t } = useI18n()
  return (
    <>
      <FormControlLabel
        control={
          <Checkbox
            name="restrictToDefaultDir"
            checked={form.restrictToDefaultDir}
            onChange={onChange}
          />
        }
        label={t('MoveIntentDemo.restrict')}
      />
      <Typography id="move-demo-tabs">{t('MoveIntentDemo.tabs')}</Typography>
      <RadioGroup
        name="tabs"
        aria-labelledby="move-demo-tabs"
        value={form.tabs}
        onChange={onChange}
      >
        <FormControlLabel
          value="default"
          control={<Radios />}
          label={t('MoveIntentDemo.defaultTabs')}
        />
        <FormControlLabel
          value="drive"
          control={<Radios />}
          label={t('MoveIntentDemo.driveOnly')}
        />
      </RadioGroup>
      <Typography id="move-demo-theme">{t('MoveIntentDemo.theme')}</Typography>
      <RadioGroup
        name="theme"
        aria-labelledby="move-demo-theme"
        value={form.theme}
        onChange={onChange}
      >
        {['default', 'light', 'dark'].map(theme => (
          <FormControlLabel
            key={theme}
            value={theme}
            control={<Radios />}
            label={t(`MoveIntentDemo.theme_${theme}`)}
          />
        ))}
      </RadioGroup>
    </>
  )
}
