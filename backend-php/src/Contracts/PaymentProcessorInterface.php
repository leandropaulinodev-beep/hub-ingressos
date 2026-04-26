<?php
declare(strict_types=1);

namespace HubIngressos\Contracts;

interface PaymentProcessorInterface
{
    public function process(array $paymentData, float $amount): array;
}
