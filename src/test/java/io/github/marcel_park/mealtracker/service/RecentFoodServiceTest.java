package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.model.RecentFood;
import io.github.marcel_park.mealtracker.model.RecentFoodId;
import io.github.marcel_park.mealtracker.repository.RecentFoodRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

// Against the database: a row per user and food is inserted once and updated afterwards.
// recent_food holds only ids (see RecentFood), so no users or foods are needed.
@DataJpaTest
class RecentFoodServiceTest {

    @Autowired
    private RecentFoodRepository repository;

    @Autowired
    private EntityManager entityManager;

    private RecentFoodService service;

    private static final Long ALICE = 1L;
    private static final Long BOB = 2L;
    private static final LocalDateTime LONG_AGO = LocalDateTime.of(2020, 1, 1, 8, 0);

    @BeforeEach
    void setUp() {
        service = new RecentFoodService(repository);
    }

    private void usedLongAgo(Long userId, Long foodId, int days) {
        repository.save(new RecentFood(new RecentFoodId(userId, foodId), LONG_AGO.plusDays(days)));
    }

    // As stored, not as held in memory.
    private List<Long> recentOf(Long userId) {
        entityManager.flush();
        entityManager.clear();
        return repository.findFoodIdsMostRecentFirst(userId, PageRequest.of(0, 50));
    }

    private LocalDateTime usedAt(Long userId, Long foodId) {
        return repository.findById(new RecentFoodId(userId, foodId)).orElseThrow().getUsedAt();
    }

    @Test
    void record_addsEachFoodOnce() {
        service.record(ALICE, List.of(10L, 11L, 10L));

        assertThat(recentOf(ALICE)).containsExactly(10L, 11L);
        assertThat(repository.count()).isEqualTo(2);
    }

    @Test
    void record_again_movesTheFoodToTheTop_inTheSameRow() {
        usedLongAgo(ALICE, 10L, 0);
        usedLongAgo(ALICE, 11L, 1);

        service.record(ALICE, List.of(10L));

        assertThat(recentOf(ALICE)).containsExactly(10L, 11L);
        assertThat(repository.count()).isEqualTo(2);
        assertThat(usedAt(ALICE, 10L)).isAfter(LONG_AGO.plusDays(1));
    }

    @Test
    void record_isPerUser() {
        usedLongAgo(BOB, 10L, 0);

        service.record(ALICE, List.of(10L));

        assertThat(recentOf(ALICE)).containsExactly(10L);
        assertThat(usedAt(BOB, 10L)).isEqualTo(LONG_AGO);
    }

    @Test
    void record_withoutFoods_writesNothing() {
        service.record(ALICE, List.of());

        assertThat(repository.count()).isZero();
    }

    @Test
    void recordAdded_countsOnlyTheFoodsThatWereNotInItBefore() {
        usedLongAgo(ALICE, 10L, 0);

        service.recordAdded(ALICE, List.of(10L, 11L), Set.of(10L, 12L));

        assertThat(recentOf(ALICE)).containsExactly(11L, 10L);
        assertThat(usedAt(ALICE, 10L)).isEqualTo(LONG_AGO);
    }
}
