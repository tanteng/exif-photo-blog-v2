import { render } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import type { Photo } from '../src/photo';

const mockPhotoGrid = jest.fn();
const mockPhotoGridInfinite = jest.fn();
const mockAnimateItems = jest.fn();

jest.mock('../src/photo/PhotoGrid', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPhotoGrid(props);
    return null;
  },
}));

jest.mock('../src/photo/PhotoGridInfinite', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPhotoGridInfinite(props);
    return null;
  },
}));

jest.mock('../src/components/AnimateItems', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockAnimateItems(props);
    return null;
  },
}));

jest.mock('../src/components/AppGrid', () => ({
  __esModule: true,
  default: ({
    contentMain,
    contentSide,
  }: {
    contentMain: ReactNode
    contentSide?: ReactNode
  }) => <>{contentMain}{contentSide}</>,
}));

jest.mock('../src/components/MaskedScroll', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('../src/photo/PhotoGridSidebar', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../src/photo/TopPhotoEntities', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../src/utility/useViewportHeight', () => ({
  __esModule: true,
  default: () => 800,
}));

jest.mock('../src/category/mobile', () => ({
  hasEnoughTopEntities: () => true,
}));

jest.mock('../src/app/config', () => ({
  IS_RECENTS_FIRST: false,
  SHOW_CATEGORIES_ON_MOBILE: true,
}));

jest.mock('../src/app/path', () => ({
  PATH_GRID_INFERRED: '/grid',
}));

jest.mock('../src/components', () => ({
  GRID_SPACE_CLASSNAME: 'space-y-4',
}));

import PhotoGridPageClient from '../src/photo/PhotoGridPageClient';

describe('PhotoGridPageClient initial animation', () => {
  beforeEach(() => {
    mockPhotoGrid.mockClear();
    mockPhotoGridInfinite.mockClear();
    mockAnimateItems.mockClear();
  });

  it('shows initial content without disabling later animations', () => {
    const props: ComponentProps<typeof PhotoGridPageClient> = {
      photos: [{ id: 'photo-1' } as Photo],
      photosCount: 2,
      photosCountWithExcludes: 2,
      sortBy: 'takenAt',
      sortWithPriority: false,
      animateInitialItems: false,
      recents: [],
      years: [],
      cameras: [],
      lenses: [],
      tags: [],
      recipes: [],
      films: [],
      focalLengths: [],
      albums: [],
    };

    render(<PhotoGridPageClient {...props} />);

    expect(mockPhotoGrid).toHaveBeenCalledTimes(1);
    expect(mockPhotoGridInfinite).toHaveBeenCalledTimes(1);
    expect(mockAnimateItems).toHaveBeenCalledTimes(1);
    expect(mockPhotoGrid.mock.calls[0][0])
      .toEqual(expect.objectContaining({ animate: false }));
    expect(mockPhotoGridInfinite.mock.calls[0][0])
      .not.toHaveProperty('animate');
    expect(mockAnimateItems.mock.calls[0][0])
      .toEqual(expect.objectContaining({ type: 'none' }));
  });
});
