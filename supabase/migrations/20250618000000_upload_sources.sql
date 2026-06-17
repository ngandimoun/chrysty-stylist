-- Upload source values for stylist_uploaded_images
-- body: body/face/mannequin reference photos (max 5 per workspace, app-enforced)
-- wardrobe: closet item photos linked to stylist_wardrobe_items (max 30 confirmed)
-- generated: AI-generated outfit look images

ALTER TABLE stylist_uploaded_images
  DROP CONSTRAINT IF EXISTS stylist_uploaded_images_source_check;

UPDATE stylist_uploaded_images
SET source = 'wardrobe'
WHERE source IN ('gallery', 'camera');

ALTER TABLE stylist_uploaded_images
  ADD CONSTRAINT stylist_uploaded_images_source_check
  CHECK (source IN ('body', 'wardrobe', 'generated'));

ALTER TABLE stylist_uploaded_images
  ALTER COLUMN source SET DEFAULT 'wardrobe';

COMMENT ON COLUMN stylist_uploaded_images.source IS
  'body: body/face/mannequin reference. wardrobe: closet item photo. generated: AI outfit image.';
