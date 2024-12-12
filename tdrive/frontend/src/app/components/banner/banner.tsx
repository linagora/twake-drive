/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { FC } from 'react';
import { Col, Layout, Row } from 'antd';
import './banner.scss';
import { X } from 'react-feather';
import { CSSProperties } from '@material-ui/styles';

type PropsType = {
  closable?: boolean;
  content?: string | JSX.Element;
  onClose?: () => any;
  height?: string | number;
  type: 'primary' | 'secondary' | 'default' | 'warning' | 'important' | 'ghost';
  style?: CSSProperties;
  contentColumnStyle?: CSSProperties;
  className?: string;
  children?: JSX.Element | JSX.Element[];
  testClassId?: string;
};

const Banner: FC<PropsType> = ({
  closable,
  content,
  onClose,
  height,
  type,
  children,
  style,
  contentColumnStyle,
  className,
  testClassId,
}) => {
  const headerStyle = {
    height: height ? height : 68,
    lineHeight: height ? `${height}px` : '68px',
    ...style,
  };

  const testId = testClassId ? `testid:${testClassId}` : ''

  return (
    <Layout.Header className={`banner-container ${type} ${className || ''} ${testId}`} style={headerStyle}>
      <Row align="middle" justify="space-between" gutter={[0, 0]} style={headerStyle}>
        <Col /* ghost column */></Col>
        <Col style={contentColumnStyle}>{content || children || ''}</Col>
        <Col className="banner-col-icon">
          {closable && <X size={16} className="icon testid:button-close" onClick={onClose} />}
        </Col>
      </Row>
    </Layout.Header>
  );
};

export default Banner;
