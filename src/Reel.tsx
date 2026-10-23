import React from 'react';
import {Citacao} from './layouts/Citacao';
import {Manchete} from './layouts/Manchete';
import type {ReelProps} from './tipos';

// Cada máscara escolhe o layout; sem indicação, usa o de citação.
export const Reel: React.FC<ReelProps> = (props) =>
  props.mascara.layout === 'manchete' ? <Manchete {...props} /> : <Citacao {...props} />;
