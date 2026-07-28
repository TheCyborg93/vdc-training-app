export type DomainEventMap = {
  "training.day.created": {
    trainingDayId: number;
    trainingPlanId: number;
    boardIds: number[];
    playerIds: number[];
  };
  "training.finished": {
    trainingDayId: number;
    completedByBoardSessionId: number;
  };
  "board.paused": {
    trainingDayId: number;
    boardSessionId: number;
    boardId: number;
  };
  "board.resumed": {
    trainingDayId: number;
    boardSessionId: number;
    boardId: number;
  };
  "board.finished": {
    trainingDayId: number;
    boardSessionId: number;
    boardId: number;
    trainingCompleted: boolean;
  };
  "board.player.changed": {
    trainingDayId: number;
    boardSessionId: number;
    boardId: number;
    playerId: number;
  };
  "board.order.changed": {
    trainingDayId: number;
    boardSessionId: number;
    boardId: number;
    order: number[];
  };
  "exercise.finished": {
    trainingDayId: number;
    boardSessionId: number;
    boardId: number;
    exerciseIndex: number;
  };
  "exercise.changed": {
    trainingDayId: number;
    boardSessionId: number;
    boardId: number;
    exerciseId: number;
    exerciseIndex: number;
  };
};

export type DomainEventName = keyof DomainEventMap;

export type DomainEvent<TName extends DomainEventName = DomainEventName> = {
  id: string;
  name: TName;
  occurredAt: string;
  payload: DomainEventMap[TName];
  metadata: {
    source: string;
    actorId?: number;
    correlationId?: string;
  };
};

export type DomainEventHandler<TName extends DomainEventName> = (
  event: DomainEvent<TName>,
) => void | Promise<void>;
