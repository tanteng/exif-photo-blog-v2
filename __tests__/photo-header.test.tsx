import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Photo } from '../src/photo';

const mockAnimateItems = jest.fn();
const mockPhotoPrevNextActions = jest.fn();

jest.mock('../src/components/AnimateItems', () => ({
  __esModule: true,
  default: (props: { items: ReactNode[] } & Record<string, unknown>) => {
    mockAnimateItems(props);
    return <>{props.items}</>;
  },
}));

jest.mock('../src/photo/PhotoPrevNextActions', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPhotoPrevNextActions(props);
    return null;
  },
}));

jest.mock('../src/photo/PhotoLink', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('../src/components/DivDebugBaselineGrid', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('../src/components/primitives/ResponsiveText', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('../src/share/ShareButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../src/app/AppState', () => ({
  useAppState: () => ({
    isGridHighDensity: false,
    setNextPhotoAnimation: undefined,
    isUserSignedIn: false,
  }),
}));

jest.mock('../src/i18n/state/client', () => ({
  useAppText: () => ({
    photo: { photo: 'Photo' },
    nav: { prev: 'Previous', next: 'Next', prevShort: 'Prev', nextShort: 'Next' },
    utility: {
      paginate: () => '1 / 1',
      paginateAction: () => 'Photo 1 of 1',
    },
  }),
}));

jest.mock('../src/photo', () => ({
  formattedDateRangeForPhotos: () => ({ start: '', end: '' }),
  titleForPhoto: () => '',
}));

import PhotoHeader from '../src/photo/PhotoHeader';

describe('PhotoHeader initial animation', () => {
  beforeEach(() => {
    mockAnimateItems.mockClear();
    mockPhotoPrevNextActions.mockClear();
  });

  it('renders without entrance animation so prev/next is visible immediately', () => {
    const photos: Photo[] = [
      { id: 'a' } as Photo,
      { id: 'b' } as Photo,
    ];

    render(<PhotoHeader
      photos={photos}
      selectedPhoto={photos[0]}
      hasAiTextGeneration={false}
    />);

    // Regression: the AnimateItems wrapper must use type="none" so the
    // header (which includes the prev/next nav) is not left at opacity:0
    // waiting for framer-motion. Chrome has been observed to skip the
    // entrance animation, hiding prev/next entirely.
    expect(mockAnimateItems).toHaveBeenCalledTimes(1);
    expect(mockAnimateItems.mock.calls[0][0])
      .toEqual(expect.objectContaining({ type: 'none' }));

    // Confirm the prev/next component is in the rendered tree.
    expect(mockPhotoPrevNextActions).toHaveBeenCalledTimes(1);
  });
});
