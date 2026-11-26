-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'PUSH');

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "medication_id" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "center" geography(Point,4326),
    "place_label" TEXT NOT NULL,
    "radius_km" DOUBLE PRECISION NOT NULL,
    "channels" "Channel"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_deliveries" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "sent" "Channel"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alerts_center_idx" ON "alerts" USING GIST ("center");

-- CreateIndex
CREATE INDEX "alerts_medication_id_active_idx" ON "alerts"("medication_id", "active");

-- CreateIndex
CREATE INDEX "alerts_user_id_idx" ON "alerts"("user_id");

-- CreateIndex
CREATE INDEX "alert_deliveries_report_id_idx" ON "alert_deliveries"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "alert_deliveries_alert_id_report_id_key" ON "alert_deliveries"("alert_id", "report_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Centro geográfico de cada alerta, calculado desde lat/lng (como branches.location).
CREATE OR REPLACE FUNCTION alerts_set_center() RETURNS trigger AS $$
BEGIN
  NEW.center := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alerts_set_center
  BEFORE INSERT OR UPDATE OF lat, lng ON "alerts"
  FOR EACH ROW EXECUTE FUNCTION alerts_set_center();
